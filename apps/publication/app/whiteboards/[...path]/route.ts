import { uploadRoute } from "@/server/uploads";

export const { GET, generateStaticParams } = uploadRoute("whiteboards");

export const dynamic = "force-static";
export const dynamicParams = false;
