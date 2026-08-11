import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listEvents, type Event } from "../storage/db";
import { themeById } from "../theme/Theme";
import { coverById } from "../theme/Cover";
import { editorial, label as labelFont, micro } from "../tokens/Typography";
import { Setup } from "./Setup";
import "./Home.css";

/**
 * "/" used to always drop straight into the create-an-event flow, even for
 * a host who already had events sitting in IndexedDB — there was no way
 * back to them except typing the URL. This is the fix: if there ARE saved
 * events, land on a list of them instead, with creating a new one as an
 * explicit action rather than the forced default. First-run (no events
 * yet) still goes straight to Setup's create flow — a list with nothing
 * in it would just be a wasted extra tap.
 */
export function Home() {
  const [events, setEvents] = useState<Event[] | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    listEvents().then((all) => {
      if (cancelled) return;
      setEvents(all.sort((a, b) => b.createdAt - a.createdAt));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (events === null) return <div className="screen home home--loading" />;
  if (events.length === 0) return <Setup />;

  return (
    <div className="screen screen--scroll home">
      <header className="home__header">
        <p className="home__eyebrow" style={micro(11)}>
          FRANKLY
        </p>
        <h1 className="home__title" style={editorial(36)}>
          Your events
        </h1>
      </header>

      <div className="home__list">
        {events.map((event) => (
          <EventCard key={event.id} event={event} onOpen={() => navigate(`/event/${event.id}`)} />
        ))}
      </div>

      <button className="home__new" onClick={() => navigate("/new")} style={labelFont(16, true)}>
        <span className="home__new-icon" aria-hidden>
          +
        </span>
        New event
      </button>
    </div>
  );
}

function EventCard({ event, onOpen }: { event: Event; onOpen: () => void }) {
  const theme = themeById(event.themeId);
  const cover = coverById(theme.cover);
  const closedLabel = event.isClosed ? "Closed" : "Collecting";

  return (
    <button className="home__card" onClick={onOpen}>
      <div className="home__card-art" style={{ background: theme.poster }}>
        {cover && <img src={`/covers/${cover.asset}`} alt="" className="home__card-photo" />}
        <div className="home__card-scrim" />
      </div>
      <div className="home__card-body">
        <p className="home__card-name" style={editorial(21)}>
          {event.name}
        </p>
        <p className="home__card-meta" style={micro(11)}>
          {theme.name.toUpperCase()} · {closedLabel.toUpperCase()}
        </p>
      </div>
    </button>
  );
}
