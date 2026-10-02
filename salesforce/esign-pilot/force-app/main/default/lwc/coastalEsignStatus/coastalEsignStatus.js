import { LightningElement, api } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import details from '@salesforce/apex/CoastalESignPilotController.details';
import refreshStatus from '@salesforce/apex/CoastalESignPilotController.refreshStatus';
import { notifyRecordUpdateAvailable } from 'lightning/uiRecordApi';
export default class CoastalEsignStatus extends NavigationMixin(LightningElement) {
    _recordId;
    data;
    busy = false;
    error;
    refreshedAt;
    @api get recordId() { return this._recordId; }
    set recordId(value) { this._recordId = value; if (value) this.load(false); }
    get hasPacket() { return Boolean(this.data?.url); }
    get status() { return (this.data?.status || 'Not sent').replaceAll('_', ' '); }
    get recipient() { return this.data?.email; }
    get hasFile() { return Boolean(this.data?.fileId); }
    get statusClass() { return this.data?.status === 'COMPLETED' ? 'status completed' : 'status'; }
    get description() {
        const descriptions = { DRAFT: 'Your packet is prepared and has not been sent.', SENT: 'Waiting for the recipient to sign.', VIEWED: 'The recipient has opened the documents.', COMPLETED: 'Signing is complete. The signed document is saved to this Opportunity.', DECLINED: 'The recipient declined to sign.', VOIDED: 'This packet was withdrawn.', EXPIRED: 'The signing invitation has expired.' };
        return descriptions[this.data?.status] || 'Open the packet to review recipient progress.';
    }
    async load(sync) {
        if (this.busy) return;
        this.busy = true; this.error = undefined;
        try {
            this.data = await (sync ? refreshStatus : details)({ recordId: this.recordId });
            if (sync) {
                this.refreshedAt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                await notifyRecordUpdateAvailable([{ recordId: this.recordId }]);
            }
        } catch(e) { this.error = e.body?.message || e.message || 'Unable to load signing status.'; }
        finally { this.busy = false; }
    }
    refresh() { this.load(true); }
    openPacket() {
        this[NavigationMixin.Navigate]({ type: 'standard__component', attributes: { componentName: 'c__coastalEsignPilot' }, state: { c__recordId: this.recordId } });
    }
    openFile() {
        this[NavigationMixin.Navigate]({ type: 'standard__recordPage', attributes: { recordId: this.data.fileId, objectApiName: 'ContentDocument', actionName: 'view' } });
    }
}
