export async function GET() {
  return new Response('Hello from API', {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
    },
  })
}
