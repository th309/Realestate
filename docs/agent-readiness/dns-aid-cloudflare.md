# DNS for AI Discovery (DNS-AID) — Cloudflare apply guide

**Action owner:** you (DNS changes happen in the Cloudflare dashboard + your registrar; they cannot be
pushed from the repo).
**Domain / zone:** `propertyiq.app` (Cloudflare is authoritative).
**Goal:** satisfy isitagentready.com's `checks.discoverability.dnsAid` — a DNSSEC-signed
SVCB/HTTPS ServiceMode record under the `_agents` namespace.

The checker resolves over DNS-over-HTTPS and requires **both**:

1. a `SVCB` (or `HTTPS`) **ServiceMode** record under `_<servicetype>._agents.propertyiq.app` with
   `alpn` + endpoint params, and
2. the zone is **DNSSEC-signed** (validating resolvers return the AD bit).

`_index` is the canonical "well-known entrypoint" service type (the agent capability index). It points
at the host that serves PropertyIQ's agent-discovery documents — `www.propertyiq.app` (which serves
`/.well-known/api-catalog`, `/.well-known/agent-skills/index.json`, the MCP server card, etc.). We also
publish `_mcp` pointing at the MCP server host. We intentionally do **not** publish `_a2a` — PropertyIQ
exposes MCP, not the A2A protocol, so advertising an A2A endpoint would be false.

---

## Step 1 — Add the SVCB records (Cloudflare → DNS → Records → Add record)

Cloudflare supports SVCB (type 64) and HTTPS (type 65) records natively. For each record below set
**Type = SVCB**, **Proxy status = DNS only** (grey cloud), **TTL = Auto**.

### Record A — agent index entrypoint (required)

| Field    | Value                                    |
| -------- | ---------------------------------------- |
| Name     | `_index._agents`                         |
| Type     | `SVCB`                                   |
| Priority | `1`                                      |
| Target   | `www.propertyiq.app`                     |
| Params   | `alpn="h2" port=443 mandatory=alpn,port` |

Zone-file / presentation form (what it resolves to):

```
_index._agents.propertyiq.app. 3600 IN SVCB 1 www.propertyiq.app. alpn="h2" port=443 mandatory=alpn,port
```

### Record B — MCP server entrypoint (recommended)

| Field    | Value                                    |
| -------- | ---------------------------------------- |
| Name     | `_mcp._agents`                           |
| Type     | `SVCB`                                   |
| Priority | `1`                                      |
| Target   | `mcp.propertyiq.app`                     |
| Params   | `alpn="h2" port=443 mandatory=alpn,port` |

```
_mcp._agents.propertyiq.app. 3600 IN SVCB 1 mcp.propertyiq.app. alpn="h2" port=443 mandatory=alpn,port
```

> Notes
>
> - **ServiceMode** = priority `1` (or higher). Priority `0` is AliasMode and will NOT satisfy the check.
> - `Target` is the hostname that actually serves the endpoint (trailing dot in zone-file form;
>   Cloudflare's UI accepts it without the dot).
> - If Cloudflare's UI presents one combined "Value" box instead of separate Priority/Target/Params
>   fields, paste exactly: `1 www.propertyiq.app. alpn="h2" port=443 mandatory=alpn,port`
>   (and the `_mcp` equivalent).

---

## Step 2 — Enable DNSSEC (one-time, required for a pass)

1. Cloudflare dashboard → **propertyiq.app** → **DNS → Settings → DNSSEC → Enable DNSSEC**.
2. Cloudflare shows a **DS record** (Key Tag, Algorithm, Digest Type, Digest, and/or a DNSKEY).
3. Go to your **domain registrar** (wherever propertyiq.app is registered) → DNSSEC section → **add the DS
   record** Cloudflare gave you. This links the chain of trust at the parent (`.app`) zone.
4. Wait for propagation (minutes to a few hours). `.app` is a secure TLD, so DS publication is supported.

> If propertyiq.app uses **Cloudflare full setup** (Cloudflare nameservers — it does, since the apex is
> proxied), DNSSEC is the one-click flow above. You only touch the registrar to paste the DS record.

---

## Step 3 — Verify

```bash
# SVCB record present (ServiceMode, priority 1):
dig +short SVCB _index._agents.propertyiq.app
dig +short SVCB _mcp._agents.propertyiq.app

# DNSSEC authenticated — look for the "ad" flag in the header:
dig +dnssec SVCB _index._agents.propertyiq.app | grep -E 'flags:|SVCB'

# DS chain at the parent:
dig DS propertyiq.app +short
```

A pass looks like: the SVCB answer prints `1 www.propertyiq.app. alpn="h2" ...`, and `dig +dnssec`
shows `flags: qr rd ra ad;` (the `ad` = authenticated data).

Then re-run isitagentready.com against `www.propertyiq.app`; `dnsAid` should flip to pass.

---

## Why these values (honesty check)

- `_index` → `www.propertyiq.app`: that host genuinely serves the agent index documents
  (`/.well-known/api-catalog`, `/.well-known/agent-skills/index.json`, `/.well-known/mcp/server-card.json`).
- `_mcp` → `mcp.propertyiq.app`: that host genuinely runs the PropertyIQ MCP server over HTTPS/2.
- `alpn="h2"`: both endpoints are HTTP/2 web services on 443. (Use `alpn="h3"` additionally only if you
  have verified HTTP/3 is enabled end-to-end — Cloudflare proxied hosts usually do, but `_agents` targets
  here are DNS-only, so keep `h2`.)
- No `_a2a` record: we do not operate an A2A agent, so we don't advertise one.
