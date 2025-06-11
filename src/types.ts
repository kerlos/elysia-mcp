// Content types based on MCP specification and FastMCP patterns
export type TextContent = {
  type: 'text';
  text: string;
};

export type ImageContent = {
  type: 'image';
  data: string;
  mimeType: string;
};

export type AudioContent = {
  type: 'audio';
  data: string;
  mimeType: string;
};

export type ResourceContent = {
  type: 'resource';
  resource: {
    uri: string;
    mimeType: string;
    text: string;
  };
};

export type PromptContent =
  | TextContent
  | ImageContent
  | AudioContent
  | ResourceContent;

export type PromptMessage = {
  role: 'user' | 'assistant';
  content: PromptContent;
};

// Utility function inspired by FastMCP for creating image content
export const createImageContent = (data: string, mimeType = 'image/png') => ({
  type: 'image' as const,
  data,
  mimeType,
});

// Utility function for creating audio content
export const createAudioContent = (data: string, mimeType = 'audio/wav') => ({
  type: 'audio' as const,
  data,
  mimeType,
});

// Utility function for creating resource content
export const createResourceContent = (
  uri: string,
  text: string,
  mimeType = 'application/json'
) => ({
  type: 'resource' as const,
  resource: {
    uri,
    mimeType,
    text,
  },
});

// Utility function for creating text content
export const createTextContent = (text: string) => ({
  type: 'text' as const,
  text,
});
