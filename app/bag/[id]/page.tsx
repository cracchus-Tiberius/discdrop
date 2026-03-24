// Legacy route stub — real bag display is at /bag?id=...
// A dummy param is returned so output: export doesn't error on this dynamic route.
// The generated /bag/_/ page intentionally renders nothing.
export function generateStaticParams() {
  return [{ id: "_" }];
}

export default function BagLegacyPage() {
  return null;
}
