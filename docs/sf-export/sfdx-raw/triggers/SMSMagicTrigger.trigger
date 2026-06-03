trigger SMSMagicTrigger on smagicinteract__smsMagic__c (after insert) {
 	new SMSMagicTriggerHandler().run();
}