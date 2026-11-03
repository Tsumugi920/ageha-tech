import { Texture, type BufferGeometry, type Material, type WebGLRenderer } from "three";

/** Release this world's renderer subscriptions, including Three's shared shader resources. */
export function trackRendererResources(renderer: Pick<WebGLRenderer, "properties" | "renderBufferDirect">): () => void {
  const properties = renderer.properties;
  type Resource = Texture | BufferGeometry | Material;
  const resources = new Set<Resource>();
  const get = properties.get;
  const draw = renderer.renderBufferDirect;
  const forget = (event: { target: Resource }) => {
    resources.delete(event.target);
    event.target.removeEventListener("dispose", forget);
  };
  const own = (resource: Resource) => {
    if (resources.has(resource)) return;
    resources.add(resource);
    resource.addEventListener("dispose", forget);
  };
  properties.get = (object) => {
    if (object instanceof Texture) own(object);
    return get(object);
  };
  renderer.renderBufferDirect = (...args) => {
    own(args[2]);
    own(args[3]);
    return draw.apply(renderer, args);
  };
  return () => {
    properties.get = get;
    renderer.renderBufferDirect = draw;
    for (const resource of resources) {
      resource.removeEventListener("dispose", forget);
      resource.dispose();
    }
    resources.clear();
  };
}
