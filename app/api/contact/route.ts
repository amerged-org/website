import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createContactHandlers, type ContactEnvironment } from "./contact";

const contact = createContactHandlers({
  environment: async () => (await getCloudflareContext({ async: true })).env as ContactEnvironment,
});

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return contact.GET(request);
}

export async function POST(request: Request) {
  return contact.POST(request);
}
