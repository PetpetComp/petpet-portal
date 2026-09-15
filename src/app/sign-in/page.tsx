import type { Metadata } from "next";
import Link from "next/link";
import { PawPrint, Trophy, CalendarDays, UsersRound } from "lucide-react";
import { LoginForm } from "./login-form";
import styles from "./login.module.css";

export const metadata: Metadata = { title: "Sign in | Petpet" };

export default function SignInPage() {
  return (
    <main className={styles.page}>
      <section className={styles.story} aria-label="About Petpet">
        <div className={styles.brand}><PawPrint size={30} aria-hidden="true" /> Petpet<span>COMPETITION PORTAL</span></div>
        <div className={styles.storyContent}>
          <div className={styles.badge}><Trophy size={16} aria-hidden="true" /> Made for every champion</div>
          <h1>Great events.<br />Happy pets.<br /><span>Unforgettable moments.</span></h1>
          <p>Bring your community together. Manage every event, participant, and competition in one place.</p>
          <div className={styles.features}>
            <div><CalendarDays aria-hidden="true" /><span>Plan your events<small>Every detail, beautifully organized.</small></span></div>
            <div><UsersRound aria-hidden="true" /><span>Connect your community<small>Participants, partners, and your team.</small></span></div>
            <div><Trophy aria-hidden="true" /><span>Celebrate every win<small>From the starting line to the podium.</small></span></div>
          </div>
        </div>
        <p className={styles.storyFooter}>A little competition. A whole lot of love.</p>
      </section>
      <section className={styles.formPanel} aria-labelledby="login-heading">
        <div className={styles.formWrap}>
          <div className={styles.formIcon}><PawPrint size={28} aria-hidden="true" /></div>
          <p className={styles.eyebrow}>WELCOME TO PETPET</p>
          <h2 id="login-heading">Welcome back</h2>
          <p className={styles.subtitle}>Sign in to manage your next great event.</p>
          <LoginForm />
          <p className={styles.help}>Need an account? <Link href="/sign-up">Sign up</Link></p>
        </div>
        <footer className={styles.footer}>Petpet Competition Portal</footer>
      </section>
    </main>
  );
}
