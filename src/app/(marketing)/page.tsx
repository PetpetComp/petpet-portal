import type { Metadata } from "next";
import Link from "next/link";
import {
  PawPrint,
  Trophy,
  Handshake,
  ArrowRight,
  Sparkles,
  CalendarDays,
  Timer,
  Award,
  BarChart3,
  Users,
  Mail,
  Phone,
  MapPin,
} from "lucide-react";
import { UpcomingEvents } from "./_components/upcoming-events";
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

const features = [
  {
    icon: CalendarDays,
    title: "Manajemen Event",
    description: "Bikin event, atur kompetisi, dan buka pendaftaran dalam satu tempat.",
  },
  {
    icon: Timer,
    title: "Race & Waktu Real-time",
    description: "Timer lomba, checkpoint, dan hasil race tercatat langsung.",
  },
  {
    icon: Award,
    title: "Penjurian Adil",
    description: "Kriteria penilaian dan drawing peserta yang transparan.",
  },
  {
    icon: Handshake,
    title: "Sponsor Terkelola",
    description: "Brand bisa daftar sendiri dan ajukan sponsorship ke event.",
  },
  {
    icon: Users,
    title: "Komunitas Peserta",
    description: "Satu akun buat daftar pet, ikut lomba, dan pantau riwayat entry.",
  },
  {
    icon: BarChart3,
    title: "Laporan Lengkap",
    description: "Rekap peserta, pembayaran, dan hasil kompetisi otomatis.",
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
            Petpet Competition Portal bantu kamu ikut lomba, ngadain event, atau
            jadi sponsor kompetisi hewan peliharaan — semua dalam satu akun.
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

      <section className={styles.section} aria-label="Tentang Petpet">
        <h2 className={styles.sectionTitle}>Apa itu Petpet?</h2>
        <p className={styles.sectionSubtitle}>
          Petpet Competition Portal adalah platform buat komunitas pecinta hewan:
          penyelenggara bisa bikin dan kelola event/kompetisi dari awal sampai
          selesai, peserta bisa daftarin hewan peliharaannya ke lomba yang
          dibuka, dan sponsor bisa nemuin event yang cocok buat brand mereka.
        </p>
      </section>

      <section className={styles.section} aria-label="Fitur Petpet">
        <h2 className={styles.sectionTitle}>Fitur yang tersedia</h2>
        <div className={styles.featureGrid}>
          {features.map((feature) => (
            <div key={feature.title} className={styles.featureCard}>
              <span className={styles.featureIcon}>
                <feature.icon size={20} aria-hidden="true" />
              </span>
              <div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <UpcomingEvents />

      <footer className={styles.siteFooter}>
        <div className={styles.footerGrid}>
          <div>
            <div className={styles.footerBrand}>
              <PawPrint size={20} aria-hidden="true" /> Petpet
            </div>
            <p>
              Platform kompetisi hewan peliharaan — buat penyelenggara, peserta,
              dan sponsor.
            </p>
          </div>
          <div>
            <h4>Jelajahi</h4>
            <Link href="/sign-in?intent=competitor">Ikut Kompetisi</Link>
            <Link href="/sign-in?intent=organizer">Kelola Event</Link>
            <Link href="/sign-in?intent=sponsor">Jadi Sponsor</Link>
          </div>
          <div>
            <h4>Kontak</h4>
            <span className={styles.footerContact}>
              <Mail size={14} aria-hidden="true" /> hello@petpetportal.id
            </span>
            <span className={styles.footerContact}>
              <Phone size={14} aria-hidden="true" /> +62 812-3456-7890
            </span>
            <span className={styles.footerContact}>
              <MapPin size={14} aria-hidden="true" /> Jakarta, Indonesia
            </span>
          </div>
        </div>
        <div className={styles.footerBottom}>
          © 2026 Petpet Competition Portal. All rights reserved.
        </div>
      </footer>
    </main>
  );
}
