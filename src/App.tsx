import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "./tokens/ThemeProvider";
import { EventLayout } from "./shell/EventLayout";
import { Home } from "./screens/Home";
import { Setup } from "./screens/Setup";
import { Poster } from "./screens/Poster";
import { SignatureOnboarding } from "./screens/SignatureOnboarding";
import { Station } from "./screens/Station";
import { Artifact } from "./screens/Artifact";
import { Wall } from "./screens/Wall";

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/new" element={<Setup />} />
          <Route path="/event/:eventId" element={<EventLayout />}>
            <Route index element={<Poster />} />
            <Route path="signature" element={<SignatureOnboarding />} />
            <Route path="station" element={<Station />} />
            <Route path="artifact" element={<Artifact />} />
            <Route path="setup" element={<Setup />} />
            <Route path="wall" element={<Wall />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
