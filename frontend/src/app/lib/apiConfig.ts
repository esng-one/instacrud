import { OpenAPI } from "@/api/core/OpenAPI";
import { installAuthInterceptor } from "@/lib/authFailure";

// Runtime config for the generated client. Lives outside src/api so `npm run generate-api` can't overwrite it.
OpenAPI.BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
installAuthInterceptor();
