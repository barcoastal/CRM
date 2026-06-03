/**A wrapper class for the SMS Template custom metadata type */
public inherited sharing class SMSTemplate {

    public String objectName;
    public String templateName;
    public String smsBody;

    public SMSTemplate(SMS_Template__mdt smsTemplate) {
        this.objectName = smsTemplate.Object__c;
        this.templateName = smsTemplate.Label;
        this.smsBody = smsTemplate.SMS_Body__c;
    }
}