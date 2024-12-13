import { RichBrowseMedia } from '../../utils/ha/browse-media/types';
import { BrowseMediaMetadata } from '../browse-media/types';
import { Engine, EventQueryResults } from '../types';

export interface BrowseMediaReolinkCameraMetadata {
  configEntryID: string;
  channel: number;
}

// ==============================
// Reolink concrete query results
// ==============================

export interface ReolinkEventQueryResults extends EventQueryResults {
  engine: Engine.Reolink;
  browseMedia: RichBrowseMedia<BrowseMediaMetadata>[];
}
