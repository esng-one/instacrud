"use client";

import { useMeContext } from "@/context/MeContext";

export default function useMe() {
  return useMeContext();
}
