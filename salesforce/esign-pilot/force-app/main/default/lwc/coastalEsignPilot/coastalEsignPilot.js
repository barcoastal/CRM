import { LightningElement, api } from 'lwc';
import details from '@salesforce/apex/CoastalESignPilotController.details';
import prepare from '@salesforce/apex/CoastalESignPilotController.prepare';
import refreshStatus from '@salesforce/apex/CoastalESignPilotController.refreshStatus';
export default class CoastalEsignPilot extends LightningElement {
    _recordId; data; error; busy=false; signerName='Bar Elezra'; includeAddendum=false; processor='SAS';
    @api get recordId(){return this._recordId;} set recordId(value){this._recordId=value;if(value)this.load();}
    get processors(){return [{label:'SAS',value:'SAS'},{label:'RAM',value:'RAM'}];}
    get hasPacket(){return !!this.data?.url;}
    get fileUrl(){return this.data?.fileId ? '/lightning/r/ContentDocument/'+this.data.fileId+'/view' : null;}
    async load(){try{this.data=await details({recordId:this.recordId});}catch(e){this.error=e.body?.message||e.message;}}
    nameChange(e){this.signerName=e.target.value;} processorChange(e){this.processor=e.detail.value;} addendumChange(e){this.includeAddendum=e.target.checked;}
    async preparePacket(){this.busy=true;this.error='';try{this.data=await prepare({recordId:this.recordId,signerName:this.signerName,includeAddendum:this.includeAddendum,processor:this.processor});}catch(e){this.error=e.body?.message||e.message;}finally{this.busy=false;}}
    async refresh(){this.busy=true;this.error='';try{this.data=await refreshStatus({recordId:this.recordId});}catch(e){this.error=e.body?.message||e.message;}finally{this.busy=false;}}
}
