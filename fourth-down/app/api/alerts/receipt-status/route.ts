// Separate from display receipts: older deployments return 404 on rollback
// rather than misinterpreting arrival/suppression telemetry as display proof.
export {POST} from '../receipt/route';
