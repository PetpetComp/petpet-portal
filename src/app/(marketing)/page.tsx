import type { Metadata } from "next";
import Link from "next/link";
import { PawPrint, Trophy, Handshake, ArrowRight, Sparkles } from "lucide-react";
import styles from "./landing.module.css";

export const metadata: Metadata = { title: "Petpet Competition Portal" };

const entries = [
  {
    key: "competitor",
    icon: PawPrint,
    title: "Ikut Kompetisi",
    description: "Daftarkan hewanmu dan ikuti kompetisi yang sedang dibuka.",
    href: "/sign-in?intent=competitor",
  },
  {
    key: "organizer",
    icon: Trophy,
    title: "Kelola Event / Kompetisi",
    description: "Bikin dan kelola event atau kompetisi untuk organisasimu.",
    href: "/sign-in?intent=organizer",
  },
  {
    key: "sponsor",
    icon: Handshake,
    title: "Jadi Sponsor",
    description: "Daftarkan brand-mu dan ajukan sponsorship ke event yang kamu mau.",
    href: "/sign-in?intent=sponsor",
  },
];

export default function LandingPage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero} aria-label="Petpet Competition Portal">
        <PawPrint className={`${styles.paw} ${styles.paw1}`} aria-hidden="true" />
        <PawPrint className={`${styles.paw} ${styles.paw2}`} aria-hidden="true" />
        <PawPrint className={`${styles.paw} ${styles.paw3}`} aria-hidden="true" />
        <PawPrint className={`${styles.paw} ${styles.paw4}`} aria-hidden="true" />
        <PawPrint className={`${styles.paw} ${styles.paw5}`} aria-hidden="true" />
        <div className={styles.heroInner}>
          <div className={styles.brand}>
            <PawPrint size={26} aria-hidden="true" /> Petpet
          </div>
          <div className={styles.badge}>
            <Sparkles size={14} aria-hidden="true" /> Made for every champion
          </div>
          <h1>
            Satu portal, <span>tiga cara</span> untuk mulai
          </h1>
          <p className={styles.heroSubtitle}>
            Mau ikut lomba, ngadain event, atau jadi sponsor — pilih peranmu dan
            langsung jalan.
          </p>
        </div>
      </section>
      <section className={styles.cards} aria-label="Pilih peranmu">
        {entries.map((entry) => (
          <Link key={entry.key} href={entry.href} className={styles.card}>
            <span className={styles.cardIcon}>
              <entry.icon size={24} aria-hidden="true" />
            </span>
            <h2>{entry.title}</h2>
            <p>{entry.description}</p>
            <span className={styles.cardCta}>
              Mulai <ArrowRight size={15} aria-hidden="true" />
            </span>
          </Link>
        ))}
      </section>
      <footer className={styles.footer}>Petpet Competition Portal · 2026</footer>
    </main>
  );
}
