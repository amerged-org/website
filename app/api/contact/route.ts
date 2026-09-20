import { createContactHandlers } from "./contact";

const contact = createContactHandlers({ environment: process.env });

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return contact.GET(request);
}

export async function POST(request: Request) {
  return contact.POST(request);
}
