import { WhiteboardPreview } from "./whiteboard/Preview";
import { whiteboardData, type WhiteboardData } from "./whiteboard/model";

/**
 * A whiteboard of the article, as its committed preview with a link to download the drawing.
 *
 * @example <Whiteboard src="/whiteboards/a.excalidraw" preview="/whiteboards/a.png" />
 */
export function Whiteboard(props: Partial<WhiteboardData> & { "data-src-range"?: string }) {
  return (
    <div data-src-range={props["data-src-range"]}>
      <WhiteboardPreview data={whiteboardData(props)} />
    </div>
  );
}
