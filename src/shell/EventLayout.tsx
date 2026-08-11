import { Navigate, Outlet, useParams } from "react-router-dom";
import { EventStoreProvider } from "../store/EventStore";
import { EventShell } from "./EventShell";

/** Every screen inside an event shares one EventStore instance and one
 * navigation shell — mounted once here, not re-created per screen. */
export function EventLayout() {
  const { eventId } = useParams();
  if (!eventId) return <Navigate to="/" replace />;

  return (
    <EventStoreProvider eventId={eventId}>
      <EventShell>
        <Outlet />
      </EventShell>
    </EventStoreProvider>
  );
}
