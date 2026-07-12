// Backward-compatible re-exports — see trafficSignals.js for implementation.
export {
  fetchTrafficSignals,
  resolveTrafficForCompetitors,
  trafficFromCompanies,
  trafficFromResearchText,
  fetchApifyTraffic,
} from './trafficSignals.js';

export { reviewSignalsFromSummaries } from './distributionSignalsReviews.js';
