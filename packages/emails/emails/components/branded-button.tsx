import { Button } from "@react-email/components";

interface BrandedButtonProps {
  href: string;
  children: React.ReactNode;
}

export default function BrandedButton({ href, children }: BrandedButtonProps) {
  return (
    <Button
      href={href}
      className="bg-brand text-white text-base font-semibold py-3 px-8 rounded-lg box-border no-underline"
      style={{ display: "block", textAlign: "center" }}
    >
      {children}
    </Button>
  );
}
