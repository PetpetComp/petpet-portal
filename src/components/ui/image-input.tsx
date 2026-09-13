"use client";
import { useId, useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, X } from "lucide-react";
import { Button } from "./button";
export function ImageInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  return (
    <div className="image-input">
      {value && (
        <Image
          src={value}
          width={80}
          height={80}
          unoptimized
          alt="Selected photo"
          className="image-preview"
        />
      )}
      <input
        ref={input}
        id={id}
        className="sr-only"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        aria-label="Choose photo"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          if (
            !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
            file.size > 2 * 1024 * 1024
          ) {
            setError("Select a PNG, JPEG, or WebP image under 2 MB.");
            return;
          }
          setError("");
          const reader = new FileReader();
          reader.onload = () => onChange(String(reader.result));
          reader.onerror = () => setError("The photo could not be read.");
          reader.readAsDataURL(file);
        }}
      />
      <Button variant="secondary" onClick={() => input.current?.click()}>
        <ImagePlus size={16} />
        {value ? "Change Photo" : "Choose Photo"}
      </Button>
      {value && (
        <Button
          variant="ghost"
          size="icon"
          aria-label="Remove photo"
          title="Remove photo"
          onClick={() => {
            onChange("");
            if (input.current) input.current.value = "";
          }}
        >
          <X size={16} />
        </Button>
      )}
      {error && (
        <span role="alert" className="form-error">
          {error}
        </span>
      )}
    </div>
  );
}
