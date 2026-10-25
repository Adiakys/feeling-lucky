using FeelingLucky;

var builder = WebApplication.CreateSlimBuilder(args);
var origins = builder.Configuration.GetSection("Cors:Origins").Get<string[]>() ?? [];
builder.Services.AddCors(cors => cors.AddDefaultPolicy(policy => policy.WithOrigins(origins).AllowAnyHeader().AllowAnyMethod()));
builder.Services.AddFeelingLucky(builder.Configuration.GetSection("FeelingLucky").Bind);

var app = builder.Build();
if (origins.Length > 0) app.UseCors();
app.MapFeelingLucky();
app.Run();
