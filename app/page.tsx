import { Hero } from "@/components/home/Hero";
import { FeaturedProjects } from "@/components/home/FeaturedProjects";
import { AboutSection } from "@/components/home/AboutSection";
import { JourneySection } from "@/components/home/JourneySection";
import { TechStackSection } from "@/components/home/TechStackSection";
import { LatestNotes } from "@/components/home/LatestNotes";
import { ContactSection } from "@/components/home/ContactSection";

export default function Home() {
  return (
    <>
      <Hero />
      <FeaturedProjects />
      <AboutSection />
      <JourneySection />
      <TechStackSection />
      <LatestNotes />
      <ContactSection />
    </>
  );
}
