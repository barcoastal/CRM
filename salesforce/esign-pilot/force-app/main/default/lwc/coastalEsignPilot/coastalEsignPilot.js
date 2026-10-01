import { LightningElement, api } from 'lwc';
import { CloseActionScreenEvent } from 'lightning/actions';
import details from '@salesforce/apex/CoastalESignPilotController.details';
import prepareReviewed from '@salesforce/apex/CoastalESignPilotController.prepareReviewed';
import openSender from '@salesforce/apex/CoastalESignPilotController.openSender';
import refreshStatus from '@salesforce/apex/CoastalESignPilotController.refreshStatus';
export default class CoastalEsignPilot extends LightningElement {
  _recordId; data; error; busy=false; senderUrl; reviewed=false;
  @api get recordId(){return this._recordId;}
  set recordId(value){this._recordId=value;if(value)this.load();}
  connectedCallback(){window.addEventListener('message',this.handleMessage);}
  disconnectedCallback(){window.removeEventListener('message',this.handleMessage);}
  handleMessage=(event)=>{
    const frame=this.template.querySelector('iframe');
    if(event.origin==='https://crm.coastaldebt-tools.com' && frame && event.source===frame.contentWindow && event.data?.type==='coastal-sign-close') this.close();
  };
  get showReview(){return !this.reviewed && !this.senderUrl;}
  get hasPacket(){return !!this.data?.url;}
  get fileUrl(){return this.data?.fileId ? '/lightning/r/ContentDocument/'+this.data.fileId+'/view' : null;}
  async load(){try{this.data=await details({recordId:this.recordId});}catch(e){this.error=e.body?.message||e.message;}}
  async reviewComplete(){this.busy=true;this.error='';try{this.data=await prepareReviewed({recordId:this.recordId});this.reviewed=true;await this.resume();}catch(e){this.error=e.body?.message||e.message;}finally{this.busy=false;}}
  async resume(){this.busy=true;this.error='';try{this.senderUrl=await openSender({recordId:this.recordId});}catch(e){this.error=e.body?.message||e.message;}finally{this.busy=false;}}
  async refresh(){this.busy=true;try{this.data=await refreshStatus({recordId:this.recordId});}catch(e){this.error=e.body?.message||e.message;}finally{this.busy=false;}}
  close(){this.dispatchEvent(new CloseActionScreenEvent());}
}
