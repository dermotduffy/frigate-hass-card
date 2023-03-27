import { RichBrowseMedia } from '../../utils/ha/browse-media/types';
import { BrowseMediaMetadata } from '../browse-media/types';
import { Engine, EventQueryResults } from '../types';

// ================================
// MotionEye concrete query results
// ================================

export interface MotionEyeEventQueryResults extends EventQueryResults {
  engine: Engine.MotionEye;
  browseMedia: RichBrowseMedia<BrowseMediaMetadata>[];
}
