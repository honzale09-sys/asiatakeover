import { motion } from "framer-motion";

const REVEAL = {
  initial: { opacity: 0, y: 48 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
};
const EASE = [0.16, 1, 0.3, 1];

export const Reveal = ({ children, delay = 0, className = "" }) => (
  <motion.div className={className} {...REVEAL} transition={{ duration: 0.9, delay, ease: EASE }}>
    {children}
  </motion.div>
);

export const SectionHead = ({ kicker, title, accent }) => (
  <div className="mb-12 lg:mb-16">
    <p className="font-mono2 text-xs uppercase tracking-[0.3em] text-[#00F0FF] mb-4">{kicker}</p>
    <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold uppercase tracking-tight leading-tight">
      {title} {accent && <span className="text-[#FF0055]">{accent}</span>}
    </h2>
  </div>
);
