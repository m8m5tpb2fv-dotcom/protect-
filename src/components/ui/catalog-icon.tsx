import type { LucideIcon, LucideProps } from "lucide-react";
import {
  AirVent, AppWindow, BatteryCharging, Bike, Building2, Calculator, CalendarHeart, Camera, Car, CircleDot, Clapperboard, Code, Disc3, DoorOpen, Droplet, Droplets, Dumbbell, Fence, Flower, Flower2, GraduationCap, Grid3x3, Hammer, Hand, HandHeart, HardHat, House, Languages, Laptop, MessageCircleHeart, Mic, Monitor, Music, Package, PackageOpen, PaintRoller, Paintbrush, Palette, PartyPopper, PenTool, Scale, Scissors, Sigma, Smartphone, Sofa, Sparkle, Sparkles, SprayCan, Swords, Tent, Truck, Video, WashingMachine, Waves, Wrench, Zap,
} from "lucide-react";

/** Curated icon registry for catalogue entries (keeps client bundles small). */
const ICONS: Record<string, LucideIcon> = { AirVent, AppWindow, BatteryCharging, Bike, Building2, Calculator, CalendarHeart, Camera, Car, CircleDot, Clapperboard, Code, Disc3, DoorOpen, Droplet, Droplets, Dumbbell, Fence, Flower, Flower2, GraduationCap, Grid3x3, Hammer, Hand, HandHeart, HardHat, House, Languages, Laptop, MessageCircleHeart, Mic, Monitor, Music, Package, PackageOpen, PaintRoller, Paintbrush, Palette, PartyPopper, PenTool, Scale, Scissors, Sigma, Smartphone, Sofa, Sparkle, Sparkles, SprayCan, Swords, Tent, Truck, Video, WashingMachine, Waves, Wrench, Zap, };

export function CatalogIcon({ name, ...props }: { name: string } & LucideProps) {
  const Icon = ICONS[name] ?? Sparkles;
  return <Icon aria-hidden strokeWidth={1.75} {...props} />;
}
