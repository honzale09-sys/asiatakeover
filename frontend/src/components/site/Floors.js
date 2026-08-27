import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Reveal, SectionHead } from "./Reveal";

const FLOORS = [
  {
    id: "main",
    floor: "Floor 01",
    name: "Main Stage",
    desc: "The heart of the takeover. Headline sets, the GANGSHII choreography show at 22:30 and a wall of sound under DUPLEX's legendary lights.",
    tags: ["Headliners", "Choreography Show", "Pop Hits", "HipHop/RnB"],
    img: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxODF8MHwxfHNlYXJjaHwxfHxuaWdodGNsdWIlMjBmZXN0aXZhbCUyMGNyb3dkfGVufDB8fHx8MTc4Nzg0NDk2OXww&ixlib=rb-4.1.0&q=85",
  },
  {
    id: "vault",
    floor: "Underground",
    name: "Vinahouse Vault",
    desc: "Low ceiling, high voltage. Non-stop Vinahouse from HCMC and Hanoi's hardest selectors until 05:00.",
    tags: ["Vinahouse", "All Night", "Underground"],
    img: "https://images.unsplash.com/photo-1599739291060-4578e77dac5d?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2MzR8MHwxfHNlYXJjaHw0fHxkaiUyMHN0YWdlJTIwbGlnaHRzfGVufDB8fHx8MTc4Nzg0NDk2OXww&ixlib=rb-4.1.0&q=85",
  },
  {
    id: "sky",
    floor: "Rooftop 01",
    name: "K-POP Sky Terrace",
    desc: "K-POP and J-POP anthems above Wenceslas Square, with the first photobooth zone and skyline views of Prague.",
    tags: ["K-POP", "J-POP", "Photobooth Zone 1", "Skyline"],
    img: "https://images.unsplash.com/photo-1731194807352-402a0130adb5?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDJ8MHwxfHNlYXJjaHw0fHxyb29mdG9wJTIwcGFydHklMjBuaWdodHxlbnwwfHx8fDE3ODc4NDQ5Njl8MA&ixlib=rb-4.1.0&q=85",
  },
  {
    id: "lounge",
    floor: "Rooftop 02",
    name: "Soju Rooftop Lounge",
    desc: "Chilled HipHop/RnB, the soju bar flowing all night, VIP tables and the second photobooth zone under the stars.",
    tags: ["Soju Bar", "VIP Zones", "Photobooth Zone 2", "HipHop/RnB"],
    img: "https://images.unsplash.com/photo-1657208431551-cbf415b8ef26?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2MzR8MHwxfHNlYXJjaHwyfHxkaiUyMHN0YWdlJTIwbGlnaHRzfGVufDB8fHx8MTc4Nzg0NDk2OXww&ixlib=rb-4.1.0&q=85",
  },
];

export default function Floors() {
  const [active, setActive] = useState(0);
  const f = FLOORS[active];

  return (
    <section id="floors" className="px-4 sm:px-8 lg:px-16 py-20 lg:py-28 bg-[#0B0C12] border-y border-white/5" data-testid="floors-section">
      <Reveal>
        <SectionHead kicker="02 / The Space" title="3 Floors" accent="+ 2 Rooftops" />
      </Reveal>
      <div className="grid lg:grid-cols-[1fr_1.4fr] gap-8 lg:gap-14">
        <Reveal delay={0.1} className="flex flex-col gap-3">
          {FLOORS.map((fl, i) => (
            <button
              key={fl.id}
              data-testid={`floor-tab-${fl.id}`}
              onClick={() => setActive(i)}
              className={`text-left border rounded-2xl px-6 py-5 transition-colors duration-300 ${
                active === i
                  ? "border-[#FF0055] bg-[#FF0055]/10 neon-shadow"
                  : "border-white/10 bg-[#0D0E15] hover:border-white/30"
              }`}
            >
              <p className="font-mono2 text-[11px] uppercase tracking-[0.25em] text-[#00F0FF] mb-1">{fl.floor}</p>
              <p className="font-display font-bold text-lg uppercase">{fl.name}</p>
            </button>
          ))}
          <p className="font-mono2 text-xs text-slate-500 mt-4 leading-relaxed">
            2 photobooth zones · VIP zones on both rooftops · soju bars all night
          </p>
        </Reveal>
        <Reveal delay={0.2}>
          <AnimatePresence mode="wait">
            <motion.div
              key={f.id}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="relative rounded-3xl overflow-hidden border border-white/10"
              data-testid="floor-panel"
            >
              <img src={f.img} alt={f.name} className="w-full h-72 sm:h-96 object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#060609] via-[#060609]/30 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8">
                <h3 className="font-display font-extrabold text-2xl sm:text-3xl uppercase mb-3">{f.name}</h3>
                <p className="text-slate-300 text-sm sm:text-base max-w-lg mb-4">{f.desc}</p>
                <div className="flex flex-wrap gap-2">
                  {f.tags.map((t) => (
                    <span key={t} className="font-mono2 text-[11px] uppercase tracking-[0.15em] border border-[#00F0FF]/40 text-[#00F0FF] rounded-full px-3 py-1">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </Reveal>
      </div>
    </section>
  );
}
