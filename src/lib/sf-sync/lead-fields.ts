/** Fields used by imported lead health checks and audited list definitions. */
export const LEAD_PARITY_FIELDS = [
 'Id','FirstName','LastName','Company','Status','LeadSource','Industry','OwnerId',
 'Owner.Name','Owner.Alias','Owner.FirstName','Owner.LastName','Owner.Username',
 'CreatedById','CreatedBy.Alias','CreatedDate','LastModifiedDate','RecordTypeId','RecordType.Name',
 'IsConverted','ConvertedDate','IsUnreadByOwner','Website','StateCode',
 'Current_Total_Debt_Amount__c',
 'CloserLookup__c','Call_Transfer_Status__c','Call_Received_By_Lookup__c','Call_Transferred_By_Lookup__c',
 'Owner_Full_Name__c','Sub_Disposition__c','five9_Disposition__c','Lead_Source_Category__c',
 'ActivityMetric.FirstEmailDateTime','LastModifiedBy.Alias','Has_Calendly_Event__c','Last_Disposition__c',
 'Last_Sub_Disposition__c','five9_Last_Disposition__c','Preferred_Language__c','Formated_Phone__c',
 'MCA_Lender_External_Id__c','Add_to_f9list_Id__c','Dialer_Group__c','Lead_Vendor_ID__r.Name',
 ...Array.from({length:10},(_,i)=>[`Creditor_${i+1}_Total_Debt__c`,`Creditor_${i+1}_Payment__c`]).flat(),
 'Owner.NameOrAlias','Owner_Username__c','Eli_Ad_click__c','Debt_Details__c',
 'UTM_Term__c','Ad_Click_Id__c','Lead_Vendor_Id_Text__c','Closer__c','Last_Contacted_DateTime__c',
] as const;
export function expandRelationshipFields(flat:Record<string,unknown>):Record<string,unknown>{
 const result={...flat};
 for(const [key,value]of Object.entries(flat)){const parts=key.split('.');if(parts.length===2){const[parent,child]=parts;result[parent]={...(typeof result[parent]==='object'&&result[parent]!==null?result[parent] as Record<string,unknown>:{}),[child]:value};}}
 return result;
}
export function missingSourceFields(current:Record<string,unknown>,source:Record<string,unknown>):string[]{
 return Object.keys(source).filter(key=>key!=='attributes'&&!(key in current));
}
