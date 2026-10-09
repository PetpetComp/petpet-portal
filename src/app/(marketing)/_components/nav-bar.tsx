import Link from "next/link";
import { PawPrint } from "lucide-react";
import styles from "../landing.module.css";

export function NavBar() {
  return (
    <header className={styles.navBar}>
      <Link href="/" className={styles.navBrand}>
        <PawPrint size={20} aria-hidden="true" /> Petpet
      </Link>
      <nav className={styles.navLinks} aria-label="Navigasi utama">
        <a href="#fitur">Fitur</a>
        <a href="#cara-kerja">Cara Kerja</a>
        <a href="#event">Event</a>
      </nav>
      <div className={styles.navActions}>
        <Link href="/sign-in" className={styles.navGhost}>
          Masuk
        </Link>
        <Link href="/sign-up" className={styles.navPrimary}>
          Daftar
        </Link>
      </div>
    </header>
  );
}
