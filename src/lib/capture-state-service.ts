import { clearDb } from './db-service';
import { clearTimelineState } from './timeline-store';

export function clearCaptureState(): void {
  clearDb();
  clearTimelineState();
}
