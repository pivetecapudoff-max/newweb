import { useState } from "react";

const CLOUD_MP4 =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260806_133255_956f653f-5d80-4b06-abd5-0f46c98b60fa.mp4";

export function Atmosphere({ variant = "landing" }: { variant?: "landing" | "desk" }) {
  const [videoOk, setVideoOk] = useState(true);

  return (
    <>
      {variant === "landing" && <div className="grain" aria-hidden="true" />}
      <div
        className={`hero-photo${videoOk ? " has-video" : " is-fallback"}${
          variant === "desk" ? " hero-photo--desk" : ""
        }`}
        aria-hidden="true"
      >
        {videoOk ? (
          <video
            className="hero-video"
            autoPlay
            muted
            loop
            playsInline
            poster="/hero-ribbon.png"
            onError={() => setVideoOk(false)}
          >
            <source src="/hero-bg.mp4" type="video/mp4" />
            <source src={CLOUD_MP4} type="video/mp4" />
          </video>
        ) : (
          <img className="hero-ribbon" src="/hero-ribbon.png" alt="" />
        )}
      </div>
    </>
  );
}
