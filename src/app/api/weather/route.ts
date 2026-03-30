import { NextResponse } from "next/server";
import { weatherCodeMap } from "@/lib/weather";

const lat = process.env.WEATHER_LAT ?? "57.663576";
const lon = process.env.WEATHER_LON ?? "41.129380";
const location = process.env.WEATHER_NAME ?? "Красная Горка";

type OpenMeteoResponse = {
  current?: {
    time: string;
    temperature_2m?: number;
    apparent_temperature?: number;
    weather_code?: number;
  };
  daily?: {
    time: string[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    weather_code?: number[];
  };
};

const toDayLabel = (date: string) =>
  new Intl.DateTimeFormat("ru-RU", { weekday: "short", day: "2-digit" }).format(
    new Date(date)
  );

export async function GET() {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", lat);
  url.searchParams.set("longitude", lon);
  url.searchParams.set(
    "current",
    "temperature_2m,apparent_temperature,weather_code"
  );
  url.searchParams.set(
    "daily",
    "temperature_2m_max,temperature_2m_min,weather_code"
  );
  url.searchParams.set("forecast_days", "3");
  url.searchParams.set("timezone", "auto");

  const res = await fetch(url, { next: { revalidate: 600 } });

  if (!res.ok) {
    return NextResponse.json({ error: "weather_failed" }, { status: 502 });
  }

  const data = (await res.json()) as OpenMeteoResponse;
  const current = data.current;
  const daily = data.daily;

  const days = (daily?.time ?? []).slice(0, 3).map((date, index) => {
    const code = daily?.weather_code?.[index];
    const mapped = typeof code === "number" ? weatherCodeMap[code] : null;
    return {
      date: toDayLabel(date),
      tempMin: daily?.temperature_2m_min?.[index] ?? null,
      tempMax: daily?.temperature_2m_max?.[index] ?? null,
      code: typeof code === "number" ? code : null,
      condition: mapped?.label ?? null,
      icon: mapped?.icon ?? null,
    };
  });

  return NextResponse.json({
    location,
    now:
      current?.temperature_2m != null
        ? {
            temp: current.temperature_2m,
            feelsLike: current.apparent_temperature ?? null,
            code: current.weather_code ?? null,
            condition:
              typeof current.weather_code === "number"
                ? weatherCodeMap[current.weather_code]?.label ?? null
                : null,
            icon:
              typeof current.weather_code === "number"
                ? weatherCodeMap[current.weather_code]?.icon ?? null
                : null,
          }
        : null,
    days,
    updatedAt: new Date().toISOString(),
  });
}
