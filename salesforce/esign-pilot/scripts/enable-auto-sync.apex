System.assertEquals(true,[SELECT IsSandbox FROM Organization LIMIT 1].IsSandbox);
System.assertEquals('00DjI0000002jHB',String.valueOf(UserInfo.getOrganizationId()).substring(0,15));
Set<String> existing=new Set<String>();
for(CronTrigger j:[SELECT CronJobDetail.Name FROM CronTrigger WHERE State NOT IN ('DELETED','COMPLETE','ERROR')]) existing.add(j.CronJobDetail.Name);
System.assert(existing.size()+12<=100,'Insufficient scheduler capacity');
for(Integer minute=0;minute<60;minute+=5) {
 String name='Coastal Sign - sandbox sync '+minute;
 if(!existing.contains(name)) System.schedule(name,'0 '+minute+' * * * ?',new CoastalESignAutoSync('006jI000000HCfvQAG'));
}
new CoastalESignAutoSync('006jI000000HCfvQAG').execute(null);
