import Link from "next/link";
export function DoorprizeWorkspace() {
  return (
    <section className="page-stack">
      <h1>Doorprize Drawing</h1>
      <p>Doorprize drawing is not available in the connected service yet.</p>
      <Link className="link-button" href="/event-management">
        Back to events
      </Link>
    </section>
  );
}
