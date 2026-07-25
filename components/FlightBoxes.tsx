type Flight = { speed: number; glide: number; turn: number; fade: number };

/** Speed/glide/turn/fade readout used on every disc card and the disc hero. */
export function FlightBoxes({
  flight,
  labels = "short",
  size = "sm",
}: {
  flight: Flight;
  labels?: "short" | "full";
  size?: "sm" | "lg";
}) {
  const cells =
    labels === "full"
      ? [
          { label: "SPEED", value: flight.speed },
          { label: "GLIDE", value: flight.glide },
          { label: "TURN", value: flight.turn },
          { label: "FADE", value: flight.fade },
        ]
      : [
          { label: "S", value: flight.speed },
          { label: "G", value: flight.glide },
          { label: "T", value: flight.turn },
          { label: "F", value: flight.fade },
        ];

  return (
    <div className="mt-3 flex gap-1.5">
      {cells.map(({ label, value }) => (
        <div
          key={label}
          className={
            size === "lg"
              ? "flex flex-1 flex-col items-center gap-0.5 rounded-xl bg-[#F1EFE6] py-2"
              : "flex-1 rounded-lg bg-[#F1EFE6] py-1.5 text-center"
          }
        >
          <div className={`font-extrabold text-[#101C14] ${size === "lg" ? "text-lg" : "text-sm"}`}>
            {value}
          </div>
          <div className="text-[9px] font-semibold uppercase tracking-wider text-[#101C1488]">
            {label}
          </div>
        </div>
      ))}
    </div>
  );
}
