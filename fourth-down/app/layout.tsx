import "./style.css";
export const metadata = {
  title: "Fourth Down | The College Football Playoff Picture",
  description:
    "Follow the road to twelve with live college football scores, transparent poll-based outlook tiers, team movement, and a 12-team bracket preview.",
  openGraph: {
    title: "Fourth Down · The road to twelve.",
    description: "Live scores. Poll movement. A clearer playoff picture.",
    type: "website",
  },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
