"use client";

type Props = {
  src: string;
  /** When false, hide browser download / save-as affordances. */
  allowDownload?: boolean;
  className?: string;
};

/** HTML audio with optional download menu disabled (Chrome/Edge controlsList). */
export function SecureAudioPlayer({
  src,
  allowDownload = false,
  className,
}: Props) {
  return (
    // eslint-disable-next-line jsx-a11y/media-has-caption -- singing playback only
    <audio
      src={src}
      controls
      controlsList={allowDownload ? undefined : "nodownload noplaybackrate"}
      onContextMenu={
        allowDownload
          ? undefined
          : (e) => {
              e.preventDefault();
            }
      }
      className={className}
      preload="metadata"
    />
  );
}
