// Reusable primitives from the "Horizon CPD" design concept
// (docs/horizon-cpd-mobile-concept.html) — the recurring structural device is
// a thin violet->amber gradient line ("the horizon") used as a progress-ring
// cap, a section divider, and a literal streak chart. Everything else stays
// quiet so this device reads as intentional, not decorative.
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import {
  VIOLET_500,
  AMBER_400,
  AMBER_600,
  GRADIENT_HORIZON,
  GRADIENT_SKY,
  PAPER_2,
  LINE,
  TEXT_FAINT,
} from '../../theme';

// ─── ProgressRing ──────────────────────────────────────────────────────────

interface ProgressRingProps {
  size?: number;
  strokeWidth?: number;
  percent: number; // 0–100
  trackColor?: string;
  children?: ReactNode;
}

export function ProgressRing({
  size = 128,
  strokeWidth = 10,
  percent,
  trackColor = 'rgba(255,255,255,0.14)',
  children,
}: ProgressRingProps) {
  const radius = (120 - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percent));
  const offset = circumference * (1 - clamped / 100);
  const gradId = `ring-grad-${size}-${strokeWidth}`;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} viewBox="0 0 120 120">
        <Defs>
          <LinearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={VIOLET_500} />
            <Stop offset="100%" stopColor={AMBER_400} />
          </LinearGradient>
        </Defs>
        <Circle cx="60" cy="60" r={radius} fill="none" stroke={trackColor} strokeWidth={strokeWidth} />
        <Circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          rotation="-90"
          origin="60,60"
        />
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}>{children}</View>
    </View>
  );
}

// ─── HorizonRule ───────────────────────────────────────────────────────────

export function HorizonRule({ style, opacity = 0.55 }: { style?: object; opacity?: number }) {
  return (
    <ExpoLinearGradient
      colors={GRADIENT_HORIZON}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={[{ height: 2, borderRadius: 2, opacity }, style]}
    />
  );
}

// ─── SkyHeader ─────────────────────────────────────────────────────────────
// Approximates the concept's radial+linear "sky" hero with a diagonal linear
// gradient (RN's LinearGradient has no radial mode) — same three ink stops.

export function SkyHeader({ children, style }: { children: ReactNode; style?: object }) {
  return (
    <ExpoLinearGradient
      colors={GRADIENT_SKY}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.6, y: 1 }}
      style={style}
    >
      {children}
    </ExpoLinearGradient>
  );
}

// ─── StreakBars ────────────────────────────────────────────────────────────
// A literal "rising horizon" bar chart — one bar per recent day, lit bars use
// the horizon gradient, unlit bars are a faint glass fill.

export function StreakBars({ days, height = 34 }: { days: Array<{ lit: boolean; h: number }>; height?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-end', height }}>
      {days.map((d, i) =>
        d.lit ? (
          <ExpoLinearGradient
            key={i}
            colors={[AMBER_400, VIOLET_500]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={{ flex: 1, height: `${Math.max(20, d.h * 100)}%`, borderRadius: 4 }}
          />
        ) : (
          <View
            key={i}
            style={{ flex: 1, height: `${Math.max(20, d.h * 100)}%`, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.14)' }}
          />
        ),
      )}
    </View>
  );
}

// ─── AchievementBadge ──────────────────────────────────────────────────────

export function AchievementBadge({
  icon,
  label,
  earned,
}: {
  icon: ReactNode;
  label: string;
  earned: boolean;
}) {
  return (
    <View
      style={{
        flex: 1,
        borderRadius: 16,
        padding: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: earned ? '#FBD9A8' : LINE,
        backgroundColor: earned ? '#FFF7ED' : '#fff',
      }}
    >
      {earned ? (
        <ExpoLinearGradient
          colors={[AMBER_400, AMBER_600]}
          style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}
        >
          {icon}
        </ExpoLinearGradient>
      ) : (
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 8,
            backgroundColor: PAPER_2,
          }}
        >
          {icon}
        </View>
      )}
      <Text
        style={{ fontSize: 11.5, fontWeight: '600', textAlign: 'center', lineHeight: 14, color: earned ? '#180F2A' : TEXT_FAINT }}
      >
        {label}
      </Text>
    </View>
  );
}

// ─── Chip ──────────────────────────────────────────────────────────────────

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  return (
    <Text
      onPress={onPress}
      style={{
        fontSize: 13,
        fontWeight: '600',
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 999,
        overflow: 'hidden',
        backgroundColor: active ? '#150a26' : PAPER_2,
        color: active ? '#fff' : '#726C87',
        borderWidth: 1,
        borderColor: active ? '#150a26' : LINE,
      }}
    >
      {label}
    </Text>
  );
}
