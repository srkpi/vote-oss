export interface NekosiaAssetVariant {
  url: string;
  extension: string;
}

export interface NekosiaImageMetadataVariant {
  width: number;
  height: number;
  size: number;
  extension: string;
}

export interface NekosiaApiImage {
  id: string;
  colors?: { main: string; palette?: string[] };
  image: {
    original: NekosiaAssetVariant;
    compressed: NekosiaAssetVariant;
  };
  metadata: {
    original: NekosiaImageMetadataVariant;
    compressed: NekosiaImageMetadataVariant;
  };
  category?: string;
  tags?: string[];
  rating?: string;
  anime?: { title: string | null; character: string | null };
  source?: { url: string | null; direct: string | null };
  attribution?: {
    artist: { username: string | null; profile: string | null } | null;
    copyright: string | null;
  };
}

export interface NekosiaApiResponse extends Partial<NekosiaApiImage> {
  success: boolean;
  status: number;
  message?: string;
  images?: NekosiaApiImage[];
}

export interface CatgirlImage {
  id: string;
  /** Compressed asset — what the gallery thumbnail itself renders. */
  url: string;
  width: number;
  height: number;
  /** Uncompressed asset — what the fullscreen lightbox tries first,
   *  falling back to `url` (already known to load) if this 404s or the
   *  browser otherwise fails to fetch it. */
  originalUrl: string;
  originalWidth: number;
  originalHeight: number;
  color: string;
  artistName: string | null;
  artistProfileUrl: string | null;
  sourceUrl: string | null;
}
