public inherited sharing class SMSWrapper {

    public final static String PH_PREFIX = '+1';
    
    public Id recordId {
        get; set;
    }

    public String smsBody {
        get; set;
    }

    public String direction {
        get; set;
    }

    public String fromPhone {
        get; set;
    }

    public String toPhone {
        get; set;
    }

    public String senderAndTime {
        get; set;
    }

    public String outboundFailureReason {
        get; set;
    }

    public String msgPanelSize {
        get; set;
    }

    public Boolean isInbound {
        get; set;
    }

    public SMSWrapper(SMS__c smsRecord) {
        this.recordId = smsRecord.Id;
        this.smsBody = smsRecord.Message_Body__c;
        this.direction = smsRecord.Is_Inbound__c ? 'incomingMessage' : 'outgoingMessage';
        this.isInbound = smsRecord.Is_Inbound__c;
        this.fromPhone = smsRecord.From_Phone__c;
        this.toPhone = smsRecord.To_Phone__c;
        if (this.isInbound == true) {
        this.senderAndTime = this.fromPhone + '  ' + smsRecord.Sent_Received_Time__c;
        } else {
            this.senderAndTime = smsRecord.createdBy.Name + '  ' + smsRecord.Sent_Received_Time__c;
        }
        this.outboundFailureReason = smsRecord.Outbound_Failure_Reason__c;
        this.msgPanelSize = String.isNotBlank(this.outboundFailureReason) ? '10' : '11';
    }

    public SMS__c getSMSInstance() {
        SMS__c smsRecord = new SMS__c();
        smsRecord.Id = recordId;
        smsRecord.Message_Body__c = smsBody;
        smsRecord.From_Phone__c = fromPhone;
        smsRecord.To_Phone__c = toPhone;
        smsRecord.Is_Inbound__c = direction == 'outgoingMessage' ? false : true;
        smsRecord.Sent_Received_Time__c = System.now();
        return smsRecord;
    }
}