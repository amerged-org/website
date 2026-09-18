import { Experience } from "./experience";
import { landingHtml } from "./landing-html";

export default function HomePage() {
  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: landingHtml }} />
      <Experience />
    </>
  );
}
