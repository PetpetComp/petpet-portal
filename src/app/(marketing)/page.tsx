import type { Metadata } from "next";
import Link from "next/link";
import { PawPrint, Trophy, Handshake } from "lucide-react";

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
    <main className="grid min-h-screen place-items-center p-8">
      <section className="page-stack" style={{ maxWidth: 960 }}>
        <h1>Petpet Competition Portal</h1>
        <p className="muted">Pilih peranmu untuk mulai.</p>
        <div className="form-grid">
          {entries.map((entry) => (
            <Link key={entry.key} href={entry.href} className="form-section">
              <entry.icon size={28} aria-hidden="true" />
              <h2>{entry.title}</h2>
              <p>{entry.description}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
