import type { Metadata } from "next";
import Link from "next/link";
import { PawPrint, Trophy, CalendarDays, UsersRound } from "lucide-react";
import { SignUpForm } from "./sign-up-form";
import styles from "./sign-up.module.css";

export const metadata: Metadata = { title: "Sign up | Petpet" };

export default function SignUpPage() {
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
      <section className={styles.formPanel} aria-labelledby="sign-up-heading">
        <div className={styles.formWrap}>
          <div className={styles.formIcon}><PawPrint size={28} aria-hidden="true" /></div>
          <p className={styles.eyebrow}>JOIN PETPET</p>
          <h2 id="sign-up-heading">Create your account</h2>
          <p className={styles.subtitle}>Set up your account to start managing events.</p>
          <SignUpForm />
          <p className={styles.help}>Already have an account? <Link href="/sign-in">Sign in</Link></p>
        </div>
        <footer className={styles.footer}>Petpet Competition Portal</footer>
      </section>
    </main>
  );
}
