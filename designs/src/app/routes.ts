import { createBrowserRouter } from "react-router";
import { Home } from "./pages/home";
import { Summary } from "./pages/summary";
import { Planner } from "./pages/planner";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Home,
  },
  {
    path: "/summary",
    Component: Summary,
  },
  {
    path: "/planner",
    Component: Planner,
  },
]);
