public without sharing class RelateSMSTaskHandler {

    Map<String, List<SMS__c>> phoneNumberSMSMap = new Map<String, List<SMS__c>>();
    List<Task> tasksToInsert = new List<Task>();

    public void createChildTask() {
        Set<String> phoneNumbers = new Set<String>();
        for (SMS__c smsRecord : (List<SMS__c>)Trigger.new) {
            String phoneNumber = getCustomerPhoneNumber(smsRecord);
            String phoneNumber2 = getCustomerPhoneNumber2(phoneNumber);
            constructPhoneNumberSMSMap(phoneNumber, smsRecord);
            constructPhoneNumberSMSMap(phoneNumber2, smsRecord);
        }
        if (!phoneNumberSMSMap.isEmpty()) {
            String phoneNumbersString = constructAllPhonesToString();
            List<List<SObject>> searchResults = [FIND :phoneNumbersString IN PHONE FIELDS RETURNING Lead (Id, Name, Phone, MobilePhone, Work_Phone__c, CreatedById), Account(Id, Name, Phone, CreatedById), Contact(Id,Name,Phone, CreatedById)];
            if (searchResults != null && searchResults.size() == 3) {
                processLeads(searchResults[0]);
                processAccounts(searchResults[1]);
                processContacts(searchResults[2]);
                insert tasksToInsert;
            }
        }   
    }

    private String getCustomerPhoneNumber(SMS__c smsRecord) {
        String phoneNumber;
        if (smsRecord.Is_Inbound__c) {
            phoneNumber = smsRecord.From_Phone__c;
        } else {
            phoneNumber = smsRecord.To_Phone__c;
        }
        return phoneNumber;
    }

    private String getCustomerPhoneNumber2(String phoneNumber) {
        String phoneNumber2;
        if (phoneNumber.startsWith(SMSWrapper.PH_PREFIX)) {
            phoneNumber2 = phoneNumber.removeStart(SMSWrapper.PH_PREFIX);
        } else {
            phoneNumber2 = SMSWrapper.PH_PREFIX + phoneNumber;
        }
        return phoneNumber2;
    }

    private void constructPhoneNumberSMSMap(String phoneNumber, SMS__c smsRecord) {
        if (String.isNotBlank(phoneNumber)) {
            if (!phoneNumberSMSMap.containsKey(phoneNumber)) {
                phoneNumberSMSMap.put(phoneNumber, new List<SMS__c>());
            }
            phoneNumberSMSMap.get(phoneNumber).add(smsRecord);
        }
    }

    private String constructAllPhonesToString() {
        return String.join(new List<String>(phoneNumberSMSMap.keySet()), ' OR ');
    }

    private void processLeads(List<Lead> leads) {
        for (Lead leadRecord : leads) {
            if (phoneNumberSMSMap.containsKey(leadRecord.Phone)) {
                for (SMS__c smsRecord : phoneNumberSMSMap.get(leadRecord.Phone)) {
                    Task taskRecordToInsert = new Task();
                    taskRecordToInsert.Parent_SMS__c = smsRecord.Id;
                    taskRecordToInsert.whoId = leadRecord.Id;
                    taskRecordToInsert.Subject = 'SMS';
                    taskRecordToInsert.Description = smsRecord.Message_Body__c;
                    taskRecordToInsert.Status = 'Completed';
                    taskRecordToInsert.recordTypeId = TaskUtil.getRecordTypeId(TaskUtil.RT_SMS);
                    tasksToInsert.add(taskRecordToInsert);
                }
            }
            if (phoneNumberSMSMap.containsKey(leadRecord.MobilePhone)) {
                for (SMS__c smsRecord : phoneNumberSMSMap.get(leadRecord.MobilePhone)) {
                    Task taskRecordToInsert = new Task();
                    taskRecordToInsert.Parent_SMS__c = smsRecord.Id;
                    taskRecordToInsert.whoId = leadRecord.Id;
                    taskRecordToInsert.Subject = 'SMS';
                    taskRecordToInsert.Description = smsRecord.Message_Body__c;
                    taskRecordToInsert.Status = 'Completed';
                    taskRecordToInsert.recordTypeId = TaskUtil.getRecordTypeId(TaskUtil.RT_SMS);
                    tasksToInsert.add(taskRecordToInsert);
                }
            }
            if (phoneNumberSMSMap.containsKey(leadRecord.Work_Phone__c)) {
                for (SMS__c smsRecord : phoneNumberSMSMap.get(leadRecord.Work_Phone__c)) {
                    Task taskRecordToInsert = new Task();
                    taskRecordToInsert.Parent_SMS__c = smsRecord.Id;
                    taskRecordToInsert.whoId = leadRecord.Id;
                    taskRecordToInsert.Subject = 'SMS';
                    taskRecordToInsert.Description = smsRecord.Message_Body__c;
                    taskRecordToInsert.Status = 'Completed';
                    taskRecordToInsert.recordTypeId = TaskUtil.getRecordTypeId(TaskUtil.RT_SMS);
                    tasksToInsert.add(taskRecordToInsert);
                }
            }
        }
    }

    private void processAccounts(List<Account> accounts) {
        for (Account accountRecord : accounts) {
            if (phoneNumberSMSMap.containsKey(accountRecord.Phone)) {
                for (SMS__c smsRecord : phoneNumberSMSMap.get(accountRecord.Phone)) {
                    Task taskRecordToInsert = new Task();
                    taskRecordToInsert.Parent_SMS__c = smsRecord.Id;
                    taskRecordToInsert.whatId = accountRecord.Id;
                    taskRecordToInsert.Subject = 'SMS';
                    taskRecordToInsert.Description = smsRecord.Message_Body__c;
                    taskRecordToInsert.Status = 'Completed';
                    taskRecordToInsert.recordTypeId = TaskUtil.getRecordTypeId(TaskUtil.RT_SMS);
                    tasksToInsert.add(taskRecordToInsert);
                }
            }
        }
    }

    private void processContacts(List<Contact> contacts) {
        for (Contact contactRecord : contacts) {
            if (phoneNumberSMSMap.containsKey(contactRecord.Phone)) {
                for (SMS__c smsRecord : phoneNumberSMSMap.get(contactRecord.Phone)) {
                    Task taskRecordToInsert = new Task();
                    taskRecordToInsert.Parent_SMS__c = smsRecord.Id;
                    taskRecordToInsert.whoId = contactRecord.Id;
                    taskRecordToInsert.Subject = 'SMS';
                    taskRecordToInsert.Description = smsRecord.Message_Body__c;
                    taskRecordToInsert.Status = 'Completed';
                    taskRecordToInsert.recordTypeId = TaskUtil.getRecordTypeId(TaskUtil.RT_SMS);
                    tasksToInsert.add(taskRecordToInsert);
                }
            }
        }
    }
}