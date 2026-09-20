"use client";

import { useEffect } from "react";
import { initExperience } from "./amerged-experience";

/** Client-only progressive enhancement (menus, loop animation, contact dialog). */
export function Experience() {
  useEffect(() => {
    return initExperience();
  }, []);
  return null;
}
