/**
 * Publishes the document mutation coordinator and contracts used by Core and Plugins.
 *
 * @module
 */
export { DocumentMutationCoordinator } from './document-mutation-coordinator.js';
export type { DocumentMutationContext, DocumentMutationCoordinatorOptions, DocumentMutationDescriptor, DocumentMutationDiagnostic, DocumentMutationErrorSink, DocumentMutationEventPort, DocumentMutationFaultSink, DocumentMutationHistoryPort, DocumentMutationHistoryRecord, DocumentMutationKind, DocumentMutationMementoPort, DocumentMutationOperationContext, DocumentMutationOperationPort, DocumentMutationParticipant, DocumentMutationPort, DocumentMutationRequest, DocumentMutationRollbackContext, DocumentMutationStatePort, DocumentMutationWarning, DocumentMutationWarningSink, MutationCommitOwner, } from './mutation-types.js';
export { DocumentMutationError, DocumentMutationRegistrationError, DocumentMutationUnrecoverableError, } from '../errors.js';
